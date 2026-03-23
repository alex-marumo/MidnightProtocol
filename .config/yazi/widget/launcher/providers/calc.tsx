import type { ProviderResult } from "../launcher"
import { execAsync } from "ags/process"

export default async function calcProvider(
  query: string,
): Promise<ProviderResult[]> {
  const q = query.trim()
  const expr = q.startsWith("=") ? q.slice(1).trim() : q

  // Only trigger if it looks like a math problem
  if (!/^[0-9().+\-*/%^ ]+$/.test(expr) || !/[0-9]/.test(expr)) return []

  try {
    const sanitizedExpr = expr.replace(/\^/g, "**")

    const result = Function(
      `"use strict"; return (${sanitizedExpr})`,
    )().toString()

    if (!result || result === expr) return []

    return [
      {
        title: result,
        subtitle: `Result for ${expr}`,
        icon: "accessories-calculator-symbolic",
        score: 10000,
        action: () => {
          execAsync(["sh", "-c", `echo -n '${result}' | wl-copy`]).catch(
            console.error,
          )
        },
      },
    ]
  } catch {
    return []
  }
}
