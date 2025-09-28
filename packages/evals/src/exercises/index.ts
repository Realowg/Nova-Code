import * as path from "path"
import * as fs from "fs/promises"
import { fileURLToPath } from "url"

// Resolve this package directory regardless of module system
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Base directory that contains the per-language exercise folders
export const EVALS_REPO_PATH = __dirname

export const exerciseLanguages = ["go", "java", "javascript", "python", "rust"] as const

export type ExerciseLanguage = (typeof exerciseLanguages)[number]

export const listDirectories = async (basePath: string, relativePath: string) => {
	try {
		const targetPath = path.resolve(basePath, relativePath)
		const entries = await fs.readdir(targetPath, { withFileTypes: true })
		return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name)
	} catch (error) {
		console.error(`Error listing directories at ${relativePath}:`, error)
		return []
	}
}

export const getExercisesForLanguage = async (basePath: string, language: ExerciseLanguage) =>
	listDirectories(basePath, language)
