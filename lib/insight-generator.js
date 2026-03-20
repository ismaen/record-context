const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are a PM assistant that analyzes meeting transcripts and extracts structured insights.
Given a raw transcript, produce the following sections. Be concise and actionable.

Respond in this exact format (use markdown):

## Summary
[3-5 sentence overview of the meeting]

## Key Decisions
- [Decision 1]
- [Decision 2]

## Action Items
- [ ] [Owner if mentioned]: [Task] -- [Deadline if mentioned]

## Open Questions
- [Question 1]

## Key Takeaways
- [Takeaway 1]

## Slack Summary
[A concise, copy-paste-ready Slack message. Use *bold* for emphasis, bullet points with -, and keep it under 10 lines. Include: one-line summary, key decisions, next steps.]

If a section has no relevant content, write "None identified." for that section.`;

class InsightGenerator {
  async generate(apiKey, transcriptText) {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the meeting transcript:\n\n${transcriptText}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    return this._parse(content);
  }

  async generateTitle(apiKey, transcriptText) {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a short, descriptive meeting title (3-8 words) from the transcript. Return ONLY the title, no quotes, no punctuation at the end. Use only letters, numbers, and spaces.',
        },
        { role: 'user', content: transcriptText },
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    return response.choices[0].message.content.trim();
  }

  _parse(content) {
    const sections = {
      summary: '',
      keyDecisions: '',
      actionItems: '',
      openQuestions: '',
      keyTakeaways: '',
      slackSummary: '',
    };

    const sectionMap = {
      'summary': 'summary',
      'key decisions': 'keyDecisions',
      'action items': 'actionItems',
      'open questions': 'openQuestions',
      'key takeaways': 'keyTakeaways',
      'slack summary': 'slackSummary',
    };

    const lines = content.split('\n');
    let currentKey = null;

    for (const line of lines) {
      const headerMatch = line.match(/^##\s+(.+)/);
      if (headerMatch) {
        const title = headerMatch[1].toLowerCase().replace(/\(.*\)/, '').trim();
        currentKey = sectionMap[title] || null;
        continue;
      }
      if (currentKey) {
        sections[currentKey] += line + '\n';
      }
    }

    // Trim all sections
    for (const key of Object.keys(sections)) {
      sections[key] = sections[key].trim();
    }

    return sections;
  }
}

module.exports = { InsightGenerator };
