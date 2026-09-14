export function haveSameOrderedPropertyImages(
  existingImages: readonly string[],
  submittedImages: readonly string[]
) {
  return (
    existingImages.length === submittedImages.length &&
    existingImages.every((url, index) => url === submittedImages[index])
  );
}
