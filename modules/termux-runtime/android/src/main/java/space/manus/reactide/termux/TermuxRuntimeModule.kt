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
  private val context: Context
    get() = appContext.reactContext ?: throw RuntimeInstallException("React context غير متاح")

  private val root: File get() = File(context.filesDir, RUNTIME_DIR)
  private val prefix: File get() = File(root, PREFIX_DIR)

  override fun definition() = ModuleDefinition {
    Name("TermuxRuntime")

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
    env["PATH"] = listOf(prefix.resolve("bin"), prefix.resolve("bin/applets")).joinToString(File.pathSeparator)
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
