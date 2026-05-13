export type NpmConfig = {
  key: string
  value: string | number | boolean
}

export type NpmConfigReference = Omit<NpmConfig, 'value'> &
  Partial<Pick<NpmConfig, 'value'>> & {
    parser?: (
      line: string | undefined,
      key: string | undefined,
      value: string | number | boolean | undefined,
    ) => string | number | boolean
  }
