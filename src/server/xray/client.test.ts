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
});
