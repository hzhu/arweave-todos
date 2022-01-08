export interface ITodo {
  id: string;
  value: string;
  complete: boolean;
}

export interface IWallet {
  kty: string;
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
}
