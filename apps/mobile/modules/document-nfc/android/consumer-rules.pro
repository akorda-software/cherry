# JMRTD looks up BouncyCastle algorithms by class name.
-keep class org.bouncycastle.** { *; }
-keep class org.jmrtd.** { *; }
-keep class net.sf.scuba.smartcards.IsoDepCardService { <init>(...); }
-dontwarn javax.naming.**
-dontwarn javax.smartcardio.**
-dontwarn org.bouncycastle.**
