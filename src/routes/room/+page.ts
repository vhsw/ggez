import { pick } from "$lib/utils"
import { redirect } from "@sveltejs/kit"
import type { PageLoad } from "./$types"

export const load = (async ({ url }) => {
  const id = url.searchParams.get("id")
  if (!id) {
    return redirect(307, "/")
  }
  const name = url.searchParams.get("name")
  if (!name) {
    url.searchParams.set("name", getRandomName())
    return redirect(307, url)
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
