import { Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/IBMPlexSansArabic";

// خط IBM Plex Sans Arabic: بديل مجاني قريب من خط ثمانية (رخصة ثمانية للاستخدام الشخصي ولا تسمح بإعادة توزيع ملفات الخط).
export const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["arabic", "latin"],
});

export const colors = {
  blush: "#fcd5cf",
  coral: "#ffa094",
  rose: "#d58f99",
  sage: "#5c9593",
  ocean: "#3c8fa6",
  ink: "#1f4a55",
  paper: "#fffaf8",
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
