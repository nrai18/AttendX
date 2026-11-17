declare module "crypto-js" {
  interface WordArray {
    toString(): string;
  }

  const CryptoJS: {
    SHA256: (message: string) => WordArray;
    lib: {
      WordArray: {
        random: (nBytes: number) => WordArray;
      };
    };
    [key: string]: any;
  };

  export default CryptoJS;
}
