/** Ce dont le mode en ligne a besoin d'une base en temps réel (Firebase en vrai, mémoire ou onglets en test). */
export interface Backend {
  /** Identifiant anonyme et stable du joueur. */
  uid(): Promise<string>;
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  remove(path: string): Promise<void>;
  push(path: string, value: unknown): Promise<string>;
  /** Appelé tout de suite avec la valeur courante, puis à chaque changement. Renvoie de quoi se désabonner. */
  onValue(path: string, cb: (value: unknown) => void, onError?: (e: Error) => void): () => void;
  /** Appelé pour chaque enfant existant puis pour chaque nouvel enfant. */
  onChildAdded(path: string, cb: (key: string, value: unknown) => void, onError?: (e: Error) => void): () => void;
}
