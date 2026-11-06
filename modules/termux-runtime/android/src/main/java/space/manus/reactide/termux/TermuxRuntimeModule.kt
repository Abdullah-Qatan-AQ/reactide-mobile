package expo.modules.termuxruntime

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import android.content.Context
import android.os.Build
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipFile

private const val RUNTIME_DIR = "termux-runtime"
private const val PREFIX_DIR = "usr"
private const val MARKER = ".installed"
private const val TERMUX_PREFIX = "/data/data/com.termux/files/usr"

class RuntimeInstallException(message: String, cause: Throwable? = null) : CodedException(message, cause)

class TermuxRuntimeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw RuntimeInstallException("React context غير متاح")

  private val root: File get() = File(context.filesDir, RUNTIME_DIR)
  private val prefix: File get() = File(root, PREFIX_DIR)

  override fun definition() = ModuleDefinition {
    Name("TermuxRuntime")

    AsyncFunction("isInstalled") { root.resolve(MARKER).isFile && prefix.resolve("bin/sh").canExecute() }

    AsyncFunction("install") { url: String, promise: Promise ->
      Thread {
        try {
          val count = installBootstrap(url)
          promise.resolve(mapOf("prefix" to prefix.absolutePath, "files" to count))
        } catch (error: Throwable) {
          promise.reject("ERR_RUNTIME_INSTALL", error.message ?: "تعذر تثبيت runtime", error)
        }
      }.start()
    }

    AsyncFunction("run") { command: String, cwd: String?, promise: Promise ->
      Thread {
        try {
          if (!root.resolve(MARKER).isFile) throw RuntimeInstallException("ثبّت runtime أولًا")
          val workDir = cwd?.let { File(it) }?.takeIf { it.isDirectory } ?: File(context.filesDir, "workspace")
          workDir.mkdirs()
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
          File(root, "home").mkdirs(); File(root, "tmp").mkdirs()
          val child = process.start()
          val stdout = child.inputStream.bufferedReader().use(BufferedReader::readText)
          val stderr = child.errorStream.bufferedReader().use(BufferedReader::readText)
          val exitCode = child.waitFor()
          promise.resolve(mapOf("stdout" to stdout, "stderr" to stderr, "exitCode" to exitCode))
        } catch (error: Throwable) {
          promise.reject("ERR_RUNTIME_COMMAND", error.message ?: "تعذر تشغيل الأمر", error)
        }
      }.start()
    }
  }

  private fun installBootstrap(url: String): Int {
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
          val parts = line.split("←", limit = 2); if (parts.size != 2) return@forEach
          val link = File(staging, parts[1]).canonicalFile
          val source = File(link.parentFile, parts[0]).canonicalFile
          if (link.path.startsWith(staging.canonicalPath + File.separator)) { link.parentFile?.mkdirs(); link.delete(); try { android.system.Os.symlink(source.path, link.path) } catch (_: Throwable) { link.writeText(source.readText()) } }
        } }
      }
    }
    root.deleteRecursively(); root.mkdirs()
    File(staging, PREFIX_DIR).copyRecursively(prefix, overwrite = true)
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
