import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';

describe('Xray routes', () => {
  it('returns 500 when Xray credentials are missing', async () => {
    const app = createApp({ miroAccessToken: 'miro-token' });

    const response = await request(app)
      .post('/api/xray/tests')
      .send({
        testSetKey: 'LW1-28042',
        scenarios: [{ sourceId: 'note-1', summary: 'Summary', gherkin: 'Scenario: test' }]
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe(
      'Set XRAY_CLIENT_ID and XRAY_CLIENT_SECRET in .env before exporting to Xray.'
    );
  });

  it('returns 400 for invalid scenarios', async () => {
    const app = createApp({
      miroAccessToken: 'miro-token',
      xrayClientId: 'client-id',
      xrayClientSecret: 'client-secret',
      xrayBaseUrl: 'https://xray.example'
    });

    const response = await request(app)
      .post('/api/xray/tests')
      .send({
        testSetKey: 'LW1-28042',
        scenarios: [{ sourceId: 'note-1', summary: '', gherkin: '' }]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Each scenario needs a sourceId, summary, and gherkin body.');
  });

  it('returns 400 for an invalid test set key or URL', async () => {
    const app = createApp({
      miroAccessToken: 'miro-token',
      xrayClientId: 'client-id',
      xrayClientSecret: 'client-secret',
      xrayBaseUrl: 'https://xray.example'
    });

    const response = await request(app)
      .post('/api/xray/tests')
      .send({
        testSetKey: 'not an issue',
        scenarios: [{ sourceId: 'note-1', summary: 'Summary', gherkin: 'Scenario: test' }]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Provide a Jira issue key or Jira issue URL for the Xray Test Set.');
  });

  it('exports valid scenarios through the injected exporter', async () => {
    const exporter = vi.fn().mockResolvedValue({
      created: [{ sourceId: 'note-1', issueId: '10001', key: 'PROJ-1' }],
      warnings: []
    });
    const app = createApp(
      {
        miroAccessToken: 'miro-token',
        xrayClientId: 'client-id',
        xrayClientSecret: 'client-secret',
        xrayBaseUrl: 'https://xray.example',
        jiraBaseUrl: 'https://levelworks.atlassian.net',
        jiraEmail: 'tester@example.com',
        jiraApiToken: 'jira-token'
      },
      undefined,
      exporter
    );

    const response = await request(app)
      .post('/api/xray/tests')
      .send({
        testSetKey: 'https://levelworks.atlassian.net/browse/LW1-28042',
        scenarios: [{ sourceId: 'note-1', summary: 'Summary', gherkin: 'Scenario: test' }]
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      created: [{ sourceId: 'note-1', issueId: '10001', key: 'PROJ-1' }],
      warnings: []
    });
    expect(exporter).toHaveBeenCalledWith(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseUrl: 'https://xray.example',
        jiraBaseUrl: 'https://levelworks.atlassian.net',
        jiraEmail: 'tester@example.com',
        jiraApiToken: 'jira-token'
      },
      {
        testSetKey: 'LW1-28042',
        scenarios: [{ sourceId: 'note-1', summary: 'Summary', gherkin: 'Scenario: test' }]
      }
    );
  });
});
