import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { RecipeEditor } from './recipe-editor';

type MenuItem = { id: string; name: string; basePrice: string };
type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  unitCost: string;
};
type Recipe = {
  id: string;
  menuItemId: string;
  ingredients: Array<{ inventoryItemId: string; quantityMilli: string }>;
  autoDeduct: boolean;
};
type RecipeResponse = {
  recipe: Recipe | null;
  foodCost?: string;
  unknownIngredients?: string[];
};

export const dynamic = 'force-dynamic';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: MenuItem | undefined;
  let recipeRes: RecipeResponse = { recipe: null };
  let inventory: InventoryItem[] = [];
  let error: string | null = null;
  try {
    const [menus, recipe, inv] = await Promise.all([
      apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
      apiFetch<RecipeResponse>(`/v1/recipes/menu/${id}`),
      apiFetch<{ items: InventoryItem[] }>('/v1/inventory/items'),
    ]);
    item = menus.items.find((m) => m.id === id);
    recipeRes = recipe;
    inventory = inv.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  if (!item) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href={`/menu/${item.id}`} className="text-sm text-emerald-700 hover:underline">
          ← {item.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Resep — {item.name}</h1>
        <p className="text-sm text-slate-500">
          Harga jual: <strong>{formatCurrency(BigInt(item.basePrice))}</strong>
          {recipeRes.foodCost ? (
            <>
              {' '}
              · Food cost: <strong>{formatCurrency(BigInt(recipeRes.foodCost))}</strong>
            </>
          ) : null}
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {inventory.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-500">Belum ada bahan baku terdaftar.</p>
          <Link
            href="/inventory/new"
            className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Tambah bahan baku
          </Link>
        </div>
      ) : (
        <RecipeEditor
          menuItemId={item.id}
          inventory={inventory}
          initialIngredients={
            recipeRes.recipe?.ingredients ?? []
          }
          initialAutoDeduct={recipeRes.recipe?.autoDeduct ?? true}
        />
      )}
    </div>
  );
}
