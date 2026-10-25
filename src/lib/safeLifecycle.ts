export async function runAfterSuccessfulSave(
  save: () => Promise<void>,
  action: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await save();
    await action();
    return true;
  } catch {
    return false;
  }
}
