import { Product } from "../../entities";
import { DomainError, Result } from "./shared";

export interface ProductRepository {
  list(): Promise<Result<Product[], DomainError>>;
  listFull(): Promise<Result<Product[], DomainError>>;
  create(data: Partial<Product>): Promise<Result<Product, DomainError>>;
  update(id: string, data: Partial<Product>): Promise<Result<Product, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}
