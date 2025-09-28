"use server"

import * as path from "path"
import { fileURLToPath } from "url"

import { exerciseLanguages, listDirectories, EVALS_REPO_PATH as DEFAULT_EVALS_REPO_PATH } from "@roo-code/evals"

const __dirname = path.dirname(fileURLToPath(import.meta.url)) // <repo>/apps/web-evals/src/actions

// Use the path exported by @roo-code/evals which resolves to the exercises directory
const EVALS_REPO_PATH = DEFAULT_EVALS_REPO_PATH

export const getExercises = async () => {
	const result = await Promise.all(
		exerciseLanguages.map(async (language) => {
			const languagePath = path.join(EVALS_REPO_PATH, language)
			const exercises = await listDirectories(EVALS_REPO_PATH, language)
			return exercises.map((exercise) => `${language}/${exercise}`)
		}),
	)

	return result.flat()
}
