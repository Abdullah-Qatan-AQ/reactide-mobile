package expo.modules.termuxruntime

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import android.content.Context
import android.os.Build
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipFile

private const val RUNTIME_DIR = "termux-runtime"
private const val PREFIX_DIR = "usr"
private const val MARKER = ".installed"
private const val TERMUX_PREFIX = "/data/data/com.termux/files/usr"
private const val MAX_PROJECT_BYTES = 4_000_000

class RuntimeInstallException(message: String, cause: Throwable? = null) : CodedException(message, cause)

class TermuxRuntimeModule : Module() {
  private val shellLock = Any()
  @Volatile private var shellProcess: Process? = null
  @Volatile private var shellOutputThread: Thread? = null

  private val context: Context
    get() = appContext.reactContext ?: throw RuntimeInstallException("React context غير متاح")

  private val root: File get() = File(context.filesDir, RUNTIME_DIR)
  private val prefix: File get() = File(root, PREFIX_DIR)

  override fun definition() = ModuleDefinition {
    Name("TermuxRuntime")
    Events("onShellOutput", "onShellExit")

    AsyncFunction("isInstalled") { root.resolve(MARKER).isFile && prefix.resolve("bin/sh").canExecute() }

    AsyncFunction("workspacePath") { workspace.absolutePath }

    AsyncFunction("install") { promise: Promise ->
      Thread {
        try {
          val count = installBootstrap()
          val update = runCommand("pkg update -y", workspace)
          promise.resolve(mapOf("prefix" to prefix.absolutePath, "files" to count, "updateExitCode" to update.third))
        } catch (error: Throwable) {
          promise.reject("ERR_RUNTIME_INSTALL", error.message ?: "تعذر تثبيت runtime", error)
        }
      }.start()
    }

    AsyncFunction("syncFiles") { files: List<Map<String, String>> ->
      var total = 0
      val seen = mutableSetOf<String>()
      workspace.mkdirs()
      files.forEach { item ->
        val name = item["name"] ?: throw RuntimeInstallException("اسم ملف غير صالح")
        val content = item["content"] ?: throw RuntimeInstallException("محتوى ملف غير صالح")
        require(name.length <= 120 && name.matches(Regex("[A-Za-z0-9_.-]+")) && name != "." && name != "..") { "اسم ملف غير مسموح: $name" }
        require(seen.add(name.lowercase())) { "اسم ملف مكرر: $name" }
        total += content.toByteArray(Charsets.UTF_8).size
        require(total <= MAX_PROJECT_BYTES) { "حجم ملفات المشروع أكبر من 4 ميغابايت" }
        File(workspace, name).writeText(content, Charsets.UTF_8)
      }
      workspace.listFiles()?.filter { it.isFile && it.name !in seen }?.forEach { it.delete() }
      workspace.absolutePath
    }

    AsyncFunction("prepareShell") { promise: Promise ->
      Thread {
        try {
          val script = prefix.resolve("bin/script")
          if (!script.canExecute()) {
            val result = runCommand("pkg update -y && pkg install -y bash util-linux", workspace)
            if (result.third != 0 || !script.canExecute()) {
              throw RuntimeInstallException("تعذر تثبيت shell تفاعلي من مستودع Termux (exit ${result.third}): ${(result.second + "\n" + result.first).takeLast(1200)}")
            }
          }
          promise.resolve(mapOf("ready" to true, "pty" to script.absolutePath))
        } catch (error: Throwable) {
          promise.reject("ERR_RUNTIME_SHELL", error.message ?: "تعذر تجهيز طرفية Termux", error)
        }
      }.start()
    }

    AsyncFunction("startShell") { cwd: String? ->
      synchronized(shellLock) {
        if (shellProcess?.isAlive == true) return@synchronized mapOf("started" to true, "reused" to true)
        if (!root.resolve(MARKER).isFile) throw RuntimeInstallException("بيئة Termux لم تكتمل بعد")
        val script = prefix.resolve("bin/script")
        val bash = prefix.resolve("bin/bash")
        if (!script.canExecute() || !bash.canExecute()) throw RuntimeInstallException("لم تُجهّز حزم bash وutil-linux بعد")
        val workDir = cwd?.let { File(it).canonicalFile }?.takeIf { it.isDirectory && it.path.startsWith(context.filesDir.canonicalPath) } ?: workspace
        workDir.mkdirs()
        val builder = ProcessBuilder(script.absolutePath, "-q", "-e", "-f", "-c", "${bash.absolutePath} --login -i", "/dev/null")
          .directory(workDir)
          .redirectErrorStream(true)
        val env = builder.environment()
        env["PREFIX"] = prefix.absolutePath
        env["TERMUX_PREFIX"] = prefix.absolutePath
        env["HOME"] = File(root, "home").absolutePath
        env["TMPDIR"] = File(root, "tmp").absolutePath
        env["PATH"] = listOf(prefix.resolve("bin"), prefix.resolve("bin/applets"), File("/system/bin"), File("/system/xbin")).joinToString(File.pathSeparator)
        env["LD_LIBRARY_PATH"] = prefix.resolve("lib").absolutePath
        env["LANG"] = "C.UTF-8"
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LINES"] = "24"
        env["COLUMNS"] = "80"
        env["ANDROID_ROOT"] = "/system"
        env["ANDROID_DATA"] = "/data"
        val process = builder.start()
        shellProcess = process
        shellOutputThread = Thread {
          try {
            val reader = process.inputStream.bufferedReader(Charsets.UTF_8)
            val buffer = CharArray(4096)
            while (true) {
              val count = reader.read(buffer)
              if (count < 0) break
              if (count == 0) continue
              val text = String(buffer, 0, count)
                .replace(Regex("\u001B\\[[0-?]*[ -/]*[@-~]"), "")
                .replace("\u0007", "")
              if (text.isNotEmpty()) sendEvent("onShellOutput", mapOf("text" to text))
            }
          } catch (_: Throwable) {
          } finally {
            val code = try { process.waitFor() } catch (_: Throwable) { -1 }
            synchronized(shellLock) { if (shellProcess === process) shellProcess = null }
            try { sendEvent("onShellExit", mapOf("exitCode" to code)) } catch (_: Throwable) { }
          }
        }.apply { name = "TermuxPtyOutput"; isDaemon = true; start() }
        mapOf("started" to true, "reused" to false)
      }
    }

    AsyncFunction("writeShell") { input: String ->
      val process = synchronized(shellLock) { shellProcess?.takeIf { it.isAlive } }
        ?: throw RuntimeInstallException("جلسة Termux غير متصلة؛ افتح الطرفية لإعادة تشغيلها")
      process.outputStream.write(input.toByteArray(Charsets.UTF_8))
      process.outputStream.flush()
      true
    }

    AsyncFunction("stopShell") {
      synchronized(shellLock) {
        shellProcess?.destroy()
        shellProcess = null
      }
      true
    }

    AsyncFunction("run") { command: String, cwd: String?, promise: Promise ->
      Thread {
        try {
          if (!root.resolve(MARKER).isFile) throw RuntimeInstallException("Termux قيد التثبيت؛ أعد المحاولة بعد اكتماله")
          val workDir = cwd?.let { File(it).canonicalFile }?.takeIf { it.isDirectory && it.path.startsWith(context.filesDir.canonicalPath) } ?: workspace
          val result = runCommand(command, workDir)
          promise.resolve(mapOf("stdout" to result.first, "stderr" to result.second, "exitCode" to result.third))
        } catch (error: Throwable) {
          promise.reject("ERR_RUNTIME_COMMAND", error.message ?: "تعذر تشغيل الأمر", error)
        }
      }.start()
    }

    OnDestroy {
      synchronized(shellLock) {
        shellProcess?.destroy()
        shellProcess = null
      }
      shellOutputThread?.interrupt()
      shellOutputThread = null
    }
  }

  private val workspace: File get() = File(root, "workspace")

  private fun runCommand(command: String, workDir: File): Triple<String, String, Int> {
    workDir.mkdirs()
    File(root, "home").mkdirs(); File(root, "tmp").mkdirs()
    val process = ProcessBuilder(prefix.resolve("bin/sh").absolutePath, "-lc", command)
      .directory(workDir)
      .redirectErrorStream(false)
    val env = process.environment()
    env["PREFIX"] = prefix.absolutePath
    env["TERMUX_PREFIX"] = prefix.absolutePath
    env["HOME"] = File(root, "home").absolutePath
    env["TMPDIR"] = File(root, "tmp").absolutePath
    env["PATH"] = listOf(prefix.resolve("bin"), prefix.resolve("bin/applets"), File("/system/bin"), File("/system/xbin")).joinToString(File.pathSeparator)
    env["LD_LIBRARY_PATH"] = prefix.resolve("lib").absolutePath
    env["LANG"] = "C.UTF-8"
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    env["ANDROID_ROOT"] = "/system"
    env["ANDROID_DATA"] = "/data"
    val child = process.start()
    val stdout = StringBuilder(); val stderr = StringBuilder()
    val outThread = Thread { child.inputStream.bufferedReader().use { stdout.append(it.readText()) } }.apply { start() }
    val errThread = Thread { child.errorStream.bufferedReader().use { stderr.append(it.readText()) } }.apply { start() }
    val exitCode = child.waitFor()
    outThread.join(); errThread.join()
    return Triple(stdout.toString(), stderr.toString(), exitCode)
  }

  private fun installBootstrap(): Int {
    val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a"
    val archive = when (abi) {
      "arm64-v8a" -> "bootstrap-aarch64.zip"
      "armeabi-v7a", "armeabi" -> "bootstrap-arm.zip"
      "x86_64" -> "bootstrap-x86_64.zip"
      "x86" -> "bootstrap-i686.zip"
      else -> throw RuntimeInstallException("معمارية Android غير مدعومة من Termux: $abi")
    }
    val url = "https://github.com/termux/termux-packages/releases/download/bootstrap-2025.03.28-r1%2Bapt-android-7/$archive"
    require(url.startsWith("https://github.com/termux/termux-packages/releases/")) { "مصدر Bootstrap غير مسموح" }
    val staging = File(context.cacheDir, "termux-bootstrap-${System.currentTimeMillis()}")
    staging.deleteRecursively(); staging.mkdirs()
    val zipFile = File(staging, "bootstrap.zip")
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 30_000; readTimeout = 120_000; instanceFollowRedirects = true
    }
    connection.connect()
    if (connection.responseCode !in 200..299) throw RuntimeInstallException("فشل تنزيل Bootstrap: HTTP ${connection.responseCode}")
    connection.inputStream.use { input -> zipFile.outputStream().use { output -> input.copyTo(output) } }
    val newPrefix = File(staging, PREFIX_DIR)
    newPrefix.mkdirs()
    var count = 0
    val linksToCreate = mutableListOf<Pair<String, String>>()
    ZipFile(zipFile).use { zip ->
      zip.entries().asSequence().forEach { entry ->
        val relative = entry.name.removePrefix("./")
        if (relative == "SYMLINKS.txt" || relative.isEmpty()) return@forEach
        val target = File(staging, relative).canonicalFile
        check(target.path.startsWith(staging.canonicalPath + File.separator)) { "مسار Bootstrap غير آمن" }
        if (entry.isDirectory) target.mkdirs() else {
          target.parentFile?.mkdirs()
          zip.getInputStream(entry).use { input -> target.outputStream().use { output -> input.copyTo(output) } }
          target.setExecutable(true, false)
          patchTextScript(target)
          count++
        }
      }
      val links = zip.getEntry("SYMLINKS.txt")
      if (links != null) {
        zip.getInputStream(links).bufferedReader().useLines { lines -> lines.forEach { line ->
          val parts = line.split("←", limit = 2)
          if (parts.size != 2) return@forEach
          val link = File(staging, parts[1]).canonicalFile
          val source = File(link.parentFile, parts[0]).canonicalFile
          val usrRoot = File(staging, PREFIX_DIR).canonicalPath + File.separator
          if (link.path.startsWith(usrRoot) && source.path.startsWith(usrRoot)) {
            linksToCreate += parts[1] to source.relativeTo(staging).path
          }
        } }
      }
    }
    root.deleteRecursively(); root.mkdirs()
    File(staging, PREFIX_DIR).copyRecursively(prefix, overwrite = true)
    linksToCreate.forEach { (linkRelative, sourceRelative) ->
      val link = File(prefix, linkRelative.removePrefix("$PREFIX_DIR/"))
      val target = File(prefix, sourceRelative.removePrefix("$PREFIX_DIR/"))
      link.parentFile?.mkdirs(); link.delete()
      try { android.system.Os.symlink(target.absolutePath, link.absolutePath) }
      catch (_: Throwable) { if (target.isFile) link.writeBytes(target.readBytes()) }
    }
    File(root, MARKER).writeText("bootstrap=${url.substringAfterLast('/').substringBefore('?')}\ninstalledAt=${System.currentTimeMillis()}\n")
    staging.deleteRecursively()
    return count
  }

  private fun patchTextScript(file: File) {
    if (!file.isFile || file.length() > 2_000_000) return
    try {
      val bytes = file.readBytes()
      if (bytes.any { it == 0.toByte() }) return
      val text = bytes.toString(Charsets.UTF_8)
      if (text.startsWith("#!") || text.contains(TERMUX_PREFIX)) {
        file.writeText(text.replace(TERMUX_PREFIX, prefix.absolutePath))
      }
    } catch (_: Throwable) { }
  }
}
