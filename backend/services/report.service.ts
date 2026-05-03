import collectReportData from './report/collectData';
import generateHTML from './report/generateHTML';
import generatePPTX from './report/generatePPTX';

class ReportService {
  testmoService: any;

  constructor(testmoService: any) {
    this.testmoService = testmoService;
  }

  async collectReportData(projectId: any, runIds: any) {
    return collectReportData(this.testmoService, projectId, runIds);
  }

  generateHTML(data: any, recommendations: any, complement: any, lang?: string) {
    return generateHTML(data, recommendations, complement, lang);
  }

  async generatePPTX(data: any, recommendations: any, complement: any, lang?: string) {
    return generatePPTX(data, recommendations, complement, lang);
  }
}

export default ReportService;
