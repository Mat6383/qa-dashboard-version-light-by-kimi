// Stub for type-only usage
export default class ReportService {
  constructor(_testmoService?: any) {}
  collectReportData(_projectId: number, _runIds: number[]) {
    return {} as any;
  }
  generateHTML(_data: any, _recommendations?: string, _complement?: string, _lang?: string) {
    return '';
  }
  async generatePPTX(_data: any, _recommendations?: string, _complement?: string, _lang?: string) {
    return {} as any;
  }
  generate() {
    return {} as any;
  }
}
