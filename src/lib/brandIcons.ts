import * as icons from "simple-icons";
import type { SimpleIcon } from "simple-icons";

/** Server only: look up a Simple Icons glyph by slug (e.g. "nextdotjs"). */
export const brandIcon = (slug: string): SimpleIcon | undefined =>
  (icons as unknown as Record<string, SimpleIcon>)[`si${slug[0].toUpperCase()}${slug.slice(1)}`];
