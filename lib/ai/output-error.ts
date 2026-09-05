/** وصل رد من النموذج، لكن مخرجه غير صالح للاعتماد. */
export class EditorialOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialOutputError";
  }
}
