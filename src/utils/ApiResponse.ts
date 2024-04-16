class ApiResponse {
  public statusCode: number;
  public data: any | null;
  public message: string;
  constructor(
    statusCode: number,
    data: any | null,
    message: string = "Success"
  ) {
    (this.statusCode = statusCode),
      (this.data = data),
      (this.message = message);
  }
}

export { ApiResponse };
