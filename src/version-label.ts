/** 타이틀·결과 하단 버전 라벨. 예: "v0.0.0 · abc1234" */
export function versionLabel(version: string, commit: string): string {
  return `v${version} · ${commit}`;
}
