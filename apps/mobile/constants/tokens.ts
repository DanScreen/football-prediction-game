/**
 * Quiet Product tokens — mirrored from the web `app/globals.css` light + dark
 * palettes. Screens pick light/dark via `useTokens()`; don't hardcode hex in UI.
 */

export type Tokens = {
  ground: string
  surface: string
  chip: string
  ink: string
  inkMid: string
  inkMuted: string
  inkFaint: string
  line: string
  lineSoft: string
  lineStrong: string
  pitch: string
  pitchDeep: string
  pitchTint: string
  pitchOn: string
  clock: string
  clockTint: string
  clockLine: string
  clockOn: string
  good: string
  bad: string
  board: string
  boardPanel: string
  boardFore: string
  boardMuted: string
  boardGold: string
}

export const lightTokens: Tokens = {
  ground: "#f7f8f7",
  surface: "#ffffff",
  chip: "#eef1ee",
  ink: "#17201b",
  inkMid: "#3d4842",
  inkMuted: "#5e6b63",
  inkFaint: "#66726b",
  line: "#e4e8e4",
  lineSoft: "#eef1ee",
  lineStrong: "#d7ded9",
  pitch: "#128749",
  pitchDeep: "#0d6b3a",
  pitchTint: "#eaf4ee",
  pitchOn: "#ffffff",
  clock: "#b45309",
  clockTint: "#fdf3e7",
  clockLine: "#f0d3a8",
  clockOn: "#ffffff",
  good: "#15803d",
  bad: "#b91c1c",
  board: "#0f4527",
  boardPanel: "#175c36",
  boardFore: "#eef7f1",
  boardMuted: "#a9c9b6",
  boardGold: "#f2c74e",
}

export const darkTokens: Tokens = {
  ground: "#0e1411",
  surface: "#151d19",
  chip: "#1e2823",
  ink: "#e8eeea",
  inkMid: "#b9c5be",
  inkMuted: "#8c9a92",
  inkFaint: "#879489",
  line: "#263029",
  lineSoft: "#1d2621",
  lineStrong: "#36443d",
  pitch: "#45c47d",
  pitchDeep: "#6ad698",
  pitchTint: "#12291d",
  pitchOn: "#04140b",
  clock: "#e8a33d",
  clockTint: "#2c2013",
  clockLine: "#4a3418",
  clockOn: "#1a1206",
  good: "#4ade80",
  bad: "#f87171",
  board: "#061a0f",
  boardPanel: "#0c2d19",
  boardFore: "#eef7f1",
  boardMuted: "#7f9d8b",
  boardGold: "#f2c74e",
}
