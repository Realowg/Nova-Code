"use server"

import * as fs from "fs"
import { spawn } from "child_process"

import { revalidatePath } from "next/cache"
import pMap from "p-map"

import {
	type ExerciseLanguage,
	exerciseLanguages,
	createRun as _createRun,
	deleteRun as _deleteRun,
	createTask,
	getExercisesForLanguage,
	EVALS_REPO_PATH as DEFAULT_EVALS_REPO_PATH,
} from "@roo-code/evals"

import { CreateRun } from "@/lib/schemas"

// Use the repo path exported by @roo-code/evals which points to its exercises directory
const EVALS_REPO_PATH = DEFAULT_EVALS_REPO_PATH

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createRun({ suite, exercises = [], systemPrompt, timeout, ...values }: CreateRun) {
	const run = await _createRun({
		...values,
		timeout,
		socketPath: "", // TODO: Get rid of this.
	})

	if (suite === "partial") {
		for (const path of exercises) {
			const [language, exercise] = path.split("/")

			if (!language || !exercise) {
				throw new Error("Invalid exercise path: " + path)
			}

			await createTask({ ...values, runId: run.id, language: language as ExerciseLanguage, exercise })
		}
	} else {
		for (const language of exerciseLanguages) {
			const exercises = await getExercisesForLanguage(EVALS_REPO_PATH, language)

			await pMap(exercises, (exercise) => createTask({ runId: run.id, language, exercise }), {
				concurrency: 10,
			})
		}
	}

	revalidatePath("/runs")

	// Vercel serverless/functions cannot spawn background processes or access Docker.
	// Only attempt to spawn the controller in environments that support it.
	try {
		const isServerful = process.env.VERCEL !== "1" && process.env.NEXT_RUNTIME !== "edge"
		if (isServerful) {
			const isRunningInDocker = fs.existsSync("/.dockerenv")

			const dockerArgs = [
				`--name evals-controller-${run.id}`,
				"--rm",
				"--network evals_default",
				"-v /var/run/docker.sock:/var/run/docker.sock",
				"-v /tmp/evals:/var/log/evals",
				"-e HOST_EXECUTION_METHOD=docker",
			]

			const cliCommand = `pnpm --filter @roo-code/evals cli --runId ${run.id}`

			const command = isRunningInDocker
				? `docker run ${dockerArgs.join(" ")} evals-runner sh -c "${cliCommand}"`
				: cliCommand

			console.log("spawn ->", command)

			const childProcess = spawn("sh", ["-c", command], {
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			})

			const logStream = fs.createWriteStream("/tmp/roo-code-evals.log", { flags: "a" })

			if (childProcess.stdout) {
				childProcess.stdout.pipe(logStream)
			}

			if (childProcess.stderr) {
				childProcess.stderr.pipe(logStream)
			}

			childProcess.unref()
		} else {
			console.warn("Skipping background evals controller spawn on Vercel/edge runtime.")
		}
	} catch (error) {
		console.error(error)
	}

	return run
}

export async function deleteRun(runId: number) {
	await _deleteRun(runId)
	revalidatePath("/runs")
}
