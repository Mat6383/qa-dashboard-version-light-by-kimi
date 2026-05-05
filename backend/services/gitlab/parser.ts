export class GitlabParser {
  static formatEstimate(seconds: number | string): string {
    const s = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    if (!s || s <= 0) return '';
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${s}s`;
  }
}
