export class SerialWriteQueue {
  private tail: Promise<void> = Promise.resolve();
  private error: unknown = null;

  enqueue<T>(write: () => Promise<T>): Promise<T> {
    const result = this.tail.then(write);

    this.tail = result.then(
      () => undefined,
      (error: unknown) => {
        this.error = error;
      },
    );

    return result;
  }

  clearError(): void {
    this.error = null;
  }

  async flush(): Promise<void> {
    await this.tail;
    if (this.error) throw this.error;
  }
}
