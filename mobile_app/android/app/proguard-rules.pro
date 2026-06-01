# Flutter Proguard Rules
# Add project specific ProGuard rules here.
# By default, Flutter already handles standard obfuscation and shrinking.

# Flutter Secure Storage / Tink rules
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
