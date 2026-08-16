import { Link, Stack } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { useTokens } from "@/lib/theme"

export default function NotFoundScreen() {
  const t = useTokens()
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.ink }]}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={{ color: t.pitch, fontSize: 15, fontWeight: "600" }}>Go home</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
})
