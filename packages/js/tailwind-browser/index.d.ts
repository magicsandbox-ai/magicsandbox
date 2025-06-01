import type { Config } from "tailwindcss";

export type TailwindConfig = Config;

export default function processTailwindBrowser(
  config: TailwindConfig,
  css?: string,
): Promise<{ processedCss: string; classMap: { [className: string]: string } }>;
