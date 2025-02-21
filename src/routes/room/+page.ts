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
    "Быстрый",
    "Высокий",
    "Едкий",
    "Крупный",
    "Острый",
    "Плотный",
    "Резкий",
    "Свежий",
    "Сочный",
    "Тонкий",
    "Хитрый",
    "Чёткий",
  ]
  const nouns = [
    "Барс",
    "Бобр",
    "Волк",
    "Индюк",
    "Канюк",
    "Конь",
    "Лев",
    "Лис",
    "Орёл",
    "Павлин",
    "Пингвин",
    "Слон",
    "Тунец",
  ]
  return `${pick(adjectives)}${pick(nouns)}`
}
