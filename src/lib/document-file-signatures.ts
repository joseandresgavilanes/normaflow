export function documentMagicMatches(extension: string, buffer: Buffer): boolean {
  const startsWith = (bytes: number[]) => buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
  const text = () => !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
  return (
    (extension === "pdf" && startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) ||
    (["doc", "xls", "ppt"].includes(extension) && startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) ||
    (["docx", "xlsx", "pptx"].includes(extension) && startsWith([0x50, 0x4b, 0x03, 0x04])) ||
    (extension === "png" && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (["jpg", "jpeg"].includes(extension) && startsWith([0xff, 0xd8, 0xff])) ||
    (extension === "gif" && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) ||
    (extension === "webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") ||
    (["txt", "csv", "md", "markdown"].includes(extension) && text())
  );
}
