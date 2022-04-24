import { existsSync as fsExistSync } from 'fs'

import { isShorthandArgument, isArgument } from './helpers'

interface ArgumentFunction {
  [key: string]: (argument: Array<string>) => unknown
}

interface ProvidedArgument {
  [key: string]: Array<string>
}

interface ShorthandDefinition {
  [key: string]: string
}

interface CommandLineReaderConstructor {
  argumentFunctions: ArgumentFunction
  shorthandDefinitions?: ShorthandDefinition
  processArgvArguments: Array<string>
}

class CommandLineReader {
  #argumentFunctions: ArgumentFunction
  #shorthandDefinitions: ShorthandDefinition
  #providedArguments: ProvidedArgument
  #firstArgumentPath: string | null

  constructor({
    argumentFunctions,
    shorthandDefinitions = {},
    processArgvArguments,
  }: CommandLineReaderConstructor) {
    this.#argumentFunctions = argumentFunctions
    this.#shorthandDefinitions = shorthandDefinitions
    this.#providedArguments = {}
    this.#firstArgumentPath = null

    let allInputArguments: Array<string> = processArgvArguments.slice(2)

    if (
      !isShorthandArgument(allInputArguments[0]) &&
      !isArgument(allInputArguments[0])
    ) {
      if (!fsExistSync(allInputArguments[0])) {
        throw new Error(
          `First argument assumed as path. Path '${allInputArguments[0]}' was not found`,
        )
      }
      this.#firstArgumentPath = allInputArguments[0]
      allInputArguments = processArgvArguments.slice(3)
    }

    for (const key in this.#argumentFunctions) {
      if (!isArgument(key)) {
        throw new Error(
          `Invalid argument of '${key}' in argumentFunctions. Argument must begin with '--' and end with a lowercase letters.\nOptionally it can precede with single '-' characters followed by lowercase letters.\n(examples: '--testing', '--test-argument', '--test-argument-two', ...)`,
        )
      }
    }

    for (const key in this.#shorthandDefinitions) {
      if (!isShorthandArgument(key)) {
        throw new Error(
          `Invalid shorthand of '${key}' in shorthandDefinitions. Shorthand must begin with '-' and end with a lowercase letter.\n(examples: '-a', '-b', '-c')`,
        )
      }

      const definedArgument = this.#shorthandDefinitions[key]

      if (!this.#argumentFunctions[definedArgument]) {
        throw new Error(
          `Shorthand '${key}' with definition '${
            this.#shorthandDefinitions[key]
          }' does not exist in argumentFunctions`,
        )
      }
    }

    /**
     * Turn input arguments from ['--keyone', 'value1', '--keytwo', 'value2']
     * to [{ argument: '--keyone', value: 'value1' }, { argument: '--keytwo', value: 'value2' }]
     */
    const formatInputArguments: Array<{ argument: string; value: string }> =
      allInputArguments.reduce(
        (prev: Array<{ argument: string; value: string }>, argument, index) => {
          if (index % 2 === 0) {
            return prev.concat({
              argument,
              value: allInputArguments[index + 1],
            })
          }
          return prev
        },
        [],
      )

    formatInputArguments.forEach((argumentObject) => {
      const originalArgument = argumentObject.argument
      const argumentValue = argumentObject.value

      let argument = originalArgument

      if (isShorthandArgument(argument)) {
        argument = this.#shorthandDefinitions[argument]
      }

      if (!this.#argumentFunctions[argument]) {
        throw new Error(
          `Invalid input argument of '${originalArgument}'. This argument does not exist in argumentFunctions`,
        )
      }

      if (!this.#providedArguments[argument]) {
        this.#providedArguments[argument] = []
      }

      this.#providedArguments[argument].push(argumentValue)
    })
  }

  getArgumentValues(arg: string): unknown {
    return this.#argumentFunctions[arg](this.#providedArguments[arg])
  }

  getFirstArgumentPath(): string | null {
    return this.#firstArgumentPath
  }
}

export { CommandLineReader }
