allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

subprojects {
    project.evaluationDependsOn(":app")
}

// ─────────────────────────────────────────────────────────────────────────────
// Force Java 17 + Kotlin JVM 17 for ALL subprojects, including Flutter plugins
// such as flutter_facebook_auth, shared_preferences_android, etc.
// ─────────────────────────────────────────────────────────────────────────────
subprojects {
    afterEvaluate {
        // ── 1. Kotlin JVM target 17 for every KotlinCompile task ──────────
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions {
                jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
            }
        }

        // ── 2. Java source/target 17 for Android library/application modules ─
        @Suppress("DEPRECATION")
        (extensions.findByName("android") as? com.android.build.gradle.BaseExtension)
            ?.compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
