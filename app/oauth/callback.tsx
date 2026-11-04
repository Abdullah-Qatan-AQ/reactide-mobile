import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export default function OAuthCallback() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>تسجيل الدخول غير متاح على Android</Text>
        <Text style={styles.body}>
          تدفق Manus الحالي لا يوثّق PKCE لتطبيقات الهاتف. أوقفنا معالجة رموز الرجوع عبر الرابط المخصص لحماية الحساب. استخدم معاينة الويب لتسجيل الدخول، أو تابع العمل المحلي وربط GitHub.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080c12", justifyContent: "center", padding: 20 },
  card: { padding: 20, borderRadius: 14, backgroundColor: "#111823", borderWidth: 1, borderColor: "#2d3d54", gap: 12 },
  title: { color: "#f3f7fc", fontSize: 18, fontWeight: "800", textAlign: "center" },
  body: { color: "#b8c6d8", fontSize: 14, lineHeight: 22, textAlign: "center" },
});
