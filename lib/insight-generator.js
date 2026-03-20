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
[A structured, copy-paste-ready Slack message. Use Slack formatting: *bold* for emphasis, bullet points with -, and blank lines between sections. Structure it as follows:

*Meeting Title / Topic*
Brief 2-3 sentence summary of what was discussed and the overall outcome.

*Key Decisions*
- Each decision as a bullet

*Action Items*
- Owner: Task (deadline if known)

*Open Questions / Blockers*
- Any unresolved items that need follow-up

*Next Steps*
- What happens next and when

Keep it informative but scannable — aim for 15-25 lines. Make sure someone who missed the meeting can fully catch up from this message alone.]

If a section has no relevant content, write "None identified." for that section.`;

class InsightGenerator {
  async generate(apiKey, transcriptText) {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is the meeting transcript:\n\n${transcriptText}` },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = response.choices[0].message.content;
    return this._parse(content);
  }

  async generateTitle(apiKey, transcriptText) {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
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
