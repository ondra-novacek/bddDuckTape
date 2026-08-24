import { describe, expect, it, vi } from 'vitest';
import { createXrayTestsInTestSet, XrayApiError } from './client';

describe('createXrayTestsInTestSet', () => {
  it('authenticates, creates cucumber tests, and attaches them to a test set', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify('token-123'), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              getTestSets: {
                results: [{ issueId: '90000', jira: { key: 'LW1-28042' } }]
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              createTest: {
                test: { issueId: '10001', jira: { key: 'PROJ-1' } },
                warnings: []
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { addTestsToTestSet: { addedTests: ['10001'], warning: null } }
          }),
          { status: 200 }
        )
      );

    const result = await createXrayTestsInTestSet(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseUrl: 'https://xray.example'
      },
      {
        testSetKey: 'LW1-28042',
        scenarios: [
          {
            sourceId: 'note-1',
            summary: 'Successful login',
            gherkin: 'Scenario: user logs in'
          }
        ]
      },
      fetcher as unknown as typeof fetch
    );

    expect(result).toEqual({
      created: [{ sourceId: 'note-1', issueId: '10001', key: 'PROJ-1' }],
      warnings: []
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://xray.example/api/v2/authenticate');
    expect(String(fetcher.mock.calls[1][0])).toBe('https://xray.example/api/v2/graphql');
    expect(String(fetcher.mock.calls[2][0])).toBe('https://xray.example/api/v2/graphql');
    expect(String(fetcher.mock.calls[3][0])).toBe('https://xray.example/api/v2/graphql');

    const lookupRequest = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(lookupRequest.variables).toEqual({ jql: "key = 'LW1-28042'" });

    const createRequest = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
    expect(createRequest.variables).toEqual({
      testType: { name: 'Cucumber' },
      gherkin: 'Scenario: user logs in',
      jira: {
        fields: {
          project: { key: 'LW1' },
          summary: 'Successful login'
        }
      }
    });

    const attachRequest = JSON.parse(String(fetcher.mock.calls[3][1]?.body));
    expect(attachRequest.variables).toEqual({
      issueId: '90000',
      testIssueIds: ['10001']
    });
  });

  it('includes created tests when attaching to the test set fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify('token-123'), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              getTestSets: {
                results: [{ issueId: '90000', jira: { key: 'LW1-28042' } }]
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              createTest: {
                test: { issueId: '10001', jira: { key: 'PROJ-1' } },
                warnings: []
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'No access' }] }), {
        status: 200
      }));

    await expect(
      createXrayTestsInTestSet(
        {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          baseUrl: 'https://xray.example'
        },
        {
          testSetKey: 'LW1-28042',
          scenarios: [
            {
              sourceId: 'note-1',
              summary: 'Successful login',
              gherkin: 'Scenario: user logs in'
            }
          ]
        },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toMatchObject({
      message: 'Created Tests but failed to attach them to the Test Set: Xray GraphQL returned errors.',
      created: [{ sourceId: 'note-1', issueId: '10001', key: 'PROJ-1' }]
    } satisfies Partial<XrayApiError>);
  });

  it('fails when the test set key cannot be resolved', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify('token-123'), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { getTestSets: { results: [] } } }), { status: 200 })
      );

    await expect(
      createXrayTestsInTestSet(
        {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          baseUrl: 'https://xray.example'
        },
        {
          testSetKey: 'LW1-99999',
          scenarios: [
            {
              sourceId: 'note-1',
              summary: 'Successful login',
              gherkin: 'Scenario: user logs in'
            }
          ]
        },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toMatchObject({
      message: 'Xray Test Set LW1-99999 was not found.'
    } satisfies Partial<XrayApiError>);
  });

  it('falls back to Jira REST issue lookup when Xray JQL does not find the test set', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify('token-123'), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { getTestSets: { results: [] } } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '77164', key: 'LW1-30482' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { getTestSet: { issueId: '77164', jira: { key: 'LW1-30482' } } } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              createTest: {
                test: { issueId: '10001', jira: { key: 'LW1-1' } },
                warnings: []
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { addTestsToTestSet: { addedTests: ['10001'], warning: null } }
          }),
          { status: 200 }
        )
      );

    const result = await createXrayTestsInTestSet(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseUrl: 'https://xray.example',
        jiraBaseUrl: 'https://levelworks.atlassian.net',
        jiraEmail: 'tester@example.com',
        jiraApiToken: 'jira-token'
      },
      {
        testSetKey: 'LW1-30482',
        scenarios: [
          {
            sourceId: 'note-1',
            summary: 'Successful login',
            gherkin: 'Scenario: user logs in'
          }
        ]
      },
      fetcher as unknown as typeof fetch
    );

    expect(result.created).toEqual([{ sourceId: 'note-1', issueId: '10001', key: 'LW1-1' }]);
    expect(String(fetcher.mock.calls[2][0])).toBe(
      'https://levelworks.atlassian.net/rest/api/3/issue/LW1-30482'
    );

    const jiraRequest = fetcher.mock.calls[2][1];
    expect(jiraRequest?.headers).toEqual({
      Authorization: `Basic ${Buffer.from('tester@example.com:jira-token').toString('base64')}`,
      Accept: 'application/json'
    });

    const xrayVerifyRequest = JSON.parse(String(fetcher.mock.calls[3][1]?.body));
    expect(xrayVerifyRequest.variables).toEqual({ issueId: '77164' });

    const attachRequest = JSON.parse(String(fetcher.mock.calls[5][1]?.body));
    expect(attachRequest.variables).toEqual({
      issueId: '77164',
      testIssueIds: ['10001']
    });
  });
});
