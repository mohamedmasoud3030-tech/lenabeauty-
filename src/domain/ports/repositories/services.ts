import { InventoryConsumption, Service, ServiceRecipe } from "../../entities";
import { DomainError, Result } from "./shared";

export interface ServiceRepository {
  list(): Promise<Result<Service[], DomainError>>;
  create(data: Partial<Service>): Promise<Result<Service, DomainError>>;
  update(id: string, data: Partial<Service>): Promise<Result<Service, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface RecipeItemInput {
  productId: string;
  quantity: number;
  unit?: string;
  estimatedCost?: number;
}

export interface ServiceRecipeRepository {
  getForService(serviceId: string): Promise<Result<ServiceRecipe | null, DomainError>>;
  saveForService(serviceId: string, items: RecipeItemInput[]): Promise<Result<ServiceRecipe, DomainError>>;
  listConsumptions(input?: { limit?: number }): Promise<Result<InventoryConsumption[], DomainError>>;
}
