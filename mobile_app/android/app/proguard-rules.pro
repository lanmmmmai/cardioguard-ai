# Flutter Proguard Rules
# Add project specific ProGuard rules here.

# Flutter Secure Storage / Tink rules
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**

# Facebook Login (flutter_facebook_auth)
-keep class com.facebook.** { *; }
-keepnames class com.facebook.** { *; }
-dontwarn com.facebook.**

# Google Sign-In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
