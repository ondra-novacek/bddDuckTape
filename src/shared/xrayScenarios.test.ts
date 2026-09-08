import { describe, expect, it } from 'vitest';
import { flattenGroupsForXray, parseXrayScenario } from './xrayScenarios';

describe('parseXrayScenario', () => {
  it('uses the first non-empty line as summary and the rest as gherkin', () => {
    expect(
      parseXrayScenario(
        'note-1',
        '\nSuccessful login\nScenario: user logs in\n  Given a valid user\n'
      )
    ).toEqual({
      sourceId: 'note-1',
      summary: 'Successful login',
      gherkin: 'Scenario: user logs in\n  Given a valid user',
      errors: []
    });
  });

  it('reports missing gherkin body', () => {
    expect(parseXrayScenario('note-2', 'Only summary')).toEqual({
      sourceId: 'note-2',
      summary: 'Only summary',
      gherkin: '',
      errors: ['Add Gherkin after the summary line.']
    });
  });

  it.each([
    ['  GIVEN a valid user', 'GIVEN a valid user'],
    ['  when they submit valid credentials', 'when they submit valid credentials']
  ])('leaves a %s first line in the gherkin body and keeps the summary empty', (firstLine, gherkin) => {
    expect(parseXrayScenario('note-3', `\n${firstLine}\nThen access is granted\n`)).toEqual({
      sourceId: 'note-3',
      summary: '',
      gherkin: `${gherkin}\nThen access is granted`,
      errors: ['Add a summary on the first line.']
    });
  });
});

describe('flattenGroupsForXray', () => {
  it('keeps green notes ordered group by group', () => {
    const scenarios = flattenGroupsForXray([
      {
        header: { id: 'blue-1', plainText: 'Group 1' },
        items: [
          { id: 'green-1', plainText: 'First\nScenario: first' },
          { id: 'green-2', plainText: 'Second\nScenario: second' }
        ]
      },
      {
        header: { id: 'blue-2', plainText: 'Group 2' },
        items: [{ id: 'green-3', plainText: 'Third\nScenario: third' }]
      }
    ]);

    expect(scenarios.map((scenario) => scenario.sourceId)).toEqual([
      'green-1',
      'green-2',
      'green-3'
    ]);
  });
});
