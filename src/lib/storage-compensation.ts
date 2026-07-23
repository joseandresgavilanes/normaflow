/** Runs persistence after an upload and compensates the object when it fails. */
export async function persistWithStorageCompensation<T>(persist: () => Promise<T>, removeUploadedObject: () => Promise<void>): Promise<T> {
  try {
    return await persist();
  } catch (error) {
    await removeUploadedObject().catch(() => undefined);
    throw error;
  }
}
