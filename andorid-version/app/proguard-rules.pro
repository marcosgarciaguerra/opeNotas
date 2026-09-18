# Add project specific ProGuard rules here.
-keepclassmembers class com.whiteboard.digital.WebAppInterface {
    public *;
}
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

