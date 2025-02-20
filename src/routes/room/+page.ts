import { pick } from "$lib/utils"
import { redirect } from "@sveltejs/kit"
import type { PageLoad } from "./$types"

export const load = (async ({ url }) => {
  const id = url.searchParams.get("id")
  const name = url.searchParams.get("name") || getRandomName()
  if (!id) {
    return redirect(307, "/")
  }
  return {
    id,
    name,
  }
}) satisfies PageLoad

const getRandomName = () => {
  const adjectives = [
    "Большой",
    "Быстрый",
    "Высокий",
    "Крупный",
    "Легкий",
    "Маленький",
    "Медленный",
    "Плотный",
    "Средний",
    "Тонкий",
    "Тяжелый",
    "Хороший",
    "Чёткий",
  ]
  const nouns = [
    "Волк",
    "Гном",
    "Индюк",
    "Канюк",
    "Лоа",
    "Медведь",
    "Орёл",
    "Пингвин",
    "Слон",
    "Троль",
  ]
  return `${pick(adjectives)}${pick(nouns)}`
}
