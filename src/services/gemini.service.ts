
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { MetadataResult } from '../models/metadata-result.model';
import { ChannelInfo, Playlist } from '../models/channel-info.model';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // This is a placeholder for the API key.
    const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY 
        ? process.env.API_KEY 
        : 'YOUR_API_KEY_HERE';
    
    if (apiKey === 'YOUR_API_KEY_HERE') {
        console.warn("Using fallback Gemini API key. Please set the API_KEY environment variable.");
    }
        
    this.ai = new GoogleGenAI({ apiKey });
  }

  // --- Helper Methods for Prompt Construction ---

  private getChannelInfoInstructions(channelInfo: ChannelInfo | null): string {
    return channelInfo ? `
      **Channel Information (for context and links):**
      - Channel Name: ${channelInfo.channelName}
      - Channel Subscription Link: ${channelInfo.channelLink} // This is a special link that prompts users to subscribe.
      - Short Channel Bio: ${channelInfo.shortDescription || 'N/A'}
      - Spotify: ${channelInfo.spotifyLink || 'N/A'}
      - Contact Email: ${channelInfo.contactEmail || 'N/A'}
      - Playlists: ${channelInfo.playlists?.map(p => `\n    - ${p.name}: ${p.link}`).join('') || 'N/A'}
      ${channelInfo.channelTags?.trim() ? `\n      - **Channel Core SEO Tags:** These are default tags for the entire channel: "${channelInfo.channelTags}". You MUST use some of these to enhance the generated video tags.` : ''}
      
      **CRITICAL LINK USAGE RULE:**
      When directing users to the channel (e.g., asking them to subscribe or check it out), you MUST ALWAYS use the "Channel Subscription Link" provided above. This applies to both the description and the pinned comment.
    ` : 'No channel information provided.';
  }

  private getKeywordInstructions(seoKeywords: string): string {
    return seoKeywords.trim()
      ? `
      **Primary SEO Keywords:**
      You MUST prioritize and naturally integrate the following user-provided keywords: "${seoKeywords}".
      - **Titles:** Incorporate at least one keyword naturally.
      - **Descriptions:** The first sentence MUST include a primary keyword.
      - **Tags:** ALL primary keywords MUST be included.
      - **Pinned Comment:** Subtly include a primary keyword.`
      : '';
  }

  private getTracklistInstructions(tracklist: string): string {
    return tracklist.trim() ? `
      **Video Tracklist:**
      The user has provided the following tracklist. You MUST format it neatly (e.g., using 'Timecode - Track Name') and include it in the description where a placeholder like [TRACKLIST] or similar might be, or in another appropriate section.
      ---
      ${tracklist}
      ---
    ` : 'No tracklist provided. Omit any tracklist section from the description.';
  }

  private getUserKeywordsForTags(seoKeywords: string): string {
    return seoKeywords.trim() 
      ? `ALL user-provided SEO keywords ("${seoKeywords}") MUST be included in this layer.`
      : 'No user-provided SEO keywords to include.';
  }

  private getDescriptionExampleInstructions(descriptionFormulaExample: string | undefined): string {
    return descriptionFormulaExample?.trim() ? `
      **Description Formatting Reference:**
      To guide your formatting, here is the ORIGINAL example description that the template was based on. Pay close attention to its use of line breaks, paragraph spacing, and overall flow. Your final output should be formatted similarly to this example.
      ---
      ${descriptionFormulaExample}
      ---
    ` : '';
  }

  private getBaseImagePart(thumbnailBase64: string) {
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: thumbnailBase64,
      },
    };
  }

  // --- Main Generation Methods ---

  async generateTitleFormulaFromExamples(fileContents: string): Promise<{ name: string; instruction: string }> {
      const userProvidedPromptTemplate = `# Role and Goal

You are a YouTube SEO Title Specialist. Your primary objective is to analyze user-uploaded YouTube thumbnail images and generate exactly 5 unique, SEO-optimized, and high-CTR (Click-Through Rate) titles in ENGLISH. You must leverage the specific knowledge base of keywords and title formulas derived from the user's original data analysis.

# Core Knowledge Base (Your Brain)

You must strictly base all your outputs on the following knowledge base. Do not deviate.

## 1. SEO Keyword Bank
{{INSERT YOUR GENERATED KEYWORD BANK HERE}}

## 2. Core SEO Title Formulas & Examples
{{INSERT YOUR GENERATED CORE FORMULAS HERE}}

# Step-by-Step Process

1. Analyze Thumbnail: When a user uploads a thumbnail, perform a detailed visual analysis to identify key elements (e.g., Season, Setting, Mood, Weather).
2. Map to Keywords: Map the extracted visual elements to the most relevant keywords in your SEO Keyword Bank.
3. Generate 5 Titles: Use a mix of the Core SEO Title Formulas to construct 5 distinct title options.
4. Apply Constraints: For EACH of the 5 titles, you must strictly follow all rules listed below.
5. Present Output: Present the 5 titles in a clean, numbered list.

# Strict Constraints & Rules

1. LANGUAGE: All 5 output titles MUST be in ENGLISH.
2. CHARACTER COUNT: Each title MUST be between 85 and 95 characters long (inclusive), including all spaces and emojis.
3. UNIQUENESS (INTERNAL): The 5 titles generated for a single thumbnail must be distinct from one another.
4. UNIQUENESS (EXTERNAL / NOVELTY): Actively avoid repeating exact titles from previous requests. Use the full breadth of your keyword bank to ensure variety.
5. FOUNDATION: You can ONLY use the keywords and formulas provided in your Core Knowledge Base.
6. FORMAT: Provide the output as a numbered list (1-5). Do not add any extra commentary.`;

      const prompt = `You are an expert prompt engineer and analyst. Your task is to analyze a list of YouTube video titles and generate a new "Title Formula" from them. A Title Formula consists of a descriptive name and a detailed instruction prompt for an AI to generate similar titles.

Follow these steps:
1.  **Analyze the Titles:** Deeply analyze the provided list of video titles. Identify patterns, common keywords, structural formulas, tone, and style. The analysis should be comprehensive, covering keyword frequency, co-occurrence, structural patterns, semantic clustering, power words, and emoji usage. From this analysis, synthesize a "Keyword Bank" and a set of "Core Formulas".
    
    Provided Titles:
    ---
    ${fileContents}
    ---

2.  **Generate a Name:** Analyze the titles to identify the main topic and, if possible, the channel name. Generate a short, concise, and descriptive name in VIETNAMESE. Use the format 'Tên Kênh - Chủ đề' if the channel name is clearly identifiable. Otherwise, just use a name that describes the topic (e.g., 'Tiêu đề Lofi Chill'). The name should be easy for users to understand.

3.  **Generate the Instruction Prompt:** Create a detailed instruction set (a new AI specialist). This instruction set must be in ENGLISH. It must use the "Keyword Bank" and "Core Formulas" you synthesized in step 1. Use the following template, replacing the placeholders with your synthesized knowledge. **CRITICAL: You MUST preserve the exact formatting of the template, including all headings (lines starting with #), newlines, and numbered lists. The final 'instruction' string in your JSON output must be a well-structured, multi-line string that is easy for a human to read and edit.**
    
    ---
    ${userProvidedPromptTemplate}
    ---
    
4.  **Output Format:** Return a single, valid JSON object with two keys: "name" (the Vietnamese name you generated) and "instruction" (the full English instruction set you created, including the synthesized knowledge).`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              instruction: { type: Type.STRING },
            },
            required: ['name', 'instruction'],
          },
        },
      });
      return JSON.parse(response.text.trim()) as { name: string; instruction: string };
    } catch (error) {
      console.error('Error generating title formula:', error);
      throw new Error('Failed to generate title formula from Gemini API.');
    }
  }

  async generateDescriptionFormulaFromExample(exampleDescription: string): Promise<{ name: string; template: string }> {
    const prompt = `YOUR ROLE AND MISSION
You are a world-class YouTube SEO and Channel Strategist. Your sole function is to act as a "Description Deconstructor." Your mission is to reverse-engineer the strategic intent behind any sample YouTube description provided by the user.
You will not chat. You will not offer advice. You will analyze and produce a framework.
YOUR ANALYSIS PROCESS (Internal Monologue)
When you receive a sample description, you will perform a deep structural analysis by following these steps:
1. Triage Audience: First, determine the description's primary target:
- Algorithm-First: Is it optimized for search? (Look for: high keyword density, keyword repetition at the start, "keyword dumping" at the end, few human-readable CTAs).
- Human-First: Is it optimized for viewer action? (Look for: clear CTAs, timestamps, social links, community-building language, well-formatted paragraphs).
- Hybrid: Does it balance both? (e.g., SEO hook followed by timestamps and playlist links).
2. Identify Content Blocks: Break the entire description into its logical building blocks. Every line, every paragraph break matters. Common blocks include:
- Title Repetition Block
- External Link Block (Spotify, Patreon, products)
- Video-Specific Hook (SEO-driven paragraph about the video)
- Timestamp / Chapters Block
- Internal Link Ecosystem (Playlists, other videos)
- Brand/Channel Introduction Block (Boilerplate "About Me")
- Community CTA Block (Social media, Discord, Subscribe)
- Legal & Admin Block (Copyright, contact email, disclaimers)
- Keyword Dump Block (A list of comma-separated keywords)
- Hashtag Block
3. Determine Block Intent: For each block, determine its strategic purpose.
- Example: If a block contains 10 links to playlists, its intent is "Audience Retention & Session Time Inflation."
- Example: If a block repeats the title 3 times, its intent is "Aggressive Keyword Saturation."
- Example: If a block is a personal message asking for 100k subs, its intent is "Personalized Community CTA."
4. Differentiate Content Type: Label each block as either:
- Dynamic: Content that MUST be written new for each video (e.g., Title, Hook, Timestamps).
- Static (Boilerplate): Content that is re-used across all videos (e.g., "About My Channel," Social Links, Playlist Links).
YOUR OUTPUT REQUIREMENTS
Your final response to the user must be structured in two (2) parts, and two parts only.

PART 1: THE FRAMEWORK NAME
First, analyze the sample description to identify the Channel Name and the main Content Topic. Then, you MUST coin a short, concise, and descriptive name for this strategy in VIETNAMESE, using the format: "[Tên Kênh] - [Chủ đề Kênh]". For example: "Lofi Study Corner - Mô tả nhạc Lofi" or "Tech Reviews VN - Mô tả Review công nghệ".

PART 2: THE FRAMEWORK TEMPLATE
This is the most critical part. You will generate a complete, reusable framework based on your analysis.
Template Rules:
1. Language: Must be 100% in English.
2. Completeness: Must be a 1-to-1 structural match to the sample. Do not omit any section, from the very first line to the very last.
3. Generalization: Do NOT copy the literal text. Replace it with generalized, bracketed placeholders that describe the function of that text.
4. Clarity: Use a clear, multi-part placeholder format: [PART X: FUNCTION_OF_PART].
5. Labeling: You MUST label the dynamic and static parts clearly for the user.
EXAMPLE OF A CORRECTLY FORMATTED FRAMEWORK BLOCK:
[PART 1: VIDEO TITLE REPETITION]
(Note: Dynamic - Repeat the exact video title here)
[Video Title Goes Here]

...

[PART 3: VIDEO-SPECIFIC HOOK]
(Note: Dynamic - Write 2-3 new sentences describing this specific video)
[Sentence 1: Hook with main keyword and emotional promise...]
[Sentence 2: State 2-3 ideal use cases (e.g., studying, working...)]

...

[PART 9: CHANNEL BOILERPLATE (ABOUT)]
(Note: Static - Reuse this section for all videos)
[Paragraph 1: Welcome to [Your Channel Name], the place for...]
[Paragraph 2: Our mission is to provide [content type] for [target audience]...]

...

[PART 11: KEYWORD DUMP]
(Note: Dynamic/Static - A list of 20-40 comma-separated keywords related to the topic)
[keyword 1], [keyword 2], [keyword 3], ...

(End of Instructions)
---
Sample Description to Analyze:
${exampleDescription}
---

**Output Format:**
Return a single, valid JSON object with two keys: "name" (the FRAMEWORK NAME you generated, in Vietnamese) and "template" (the full FRAMEWORK TEMPLATE string you created).`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              template: { type: Type.STRING },
            },
            required: ['name', 'template'],
          },
        },
      });
      return JSON.parse(response.text.trim()) as { name: string; template: string };
    } catch (error) {
      console.error('Error generating description formula:', error);
      throw new Error('Failed to generate description formula from Gemini API.');
    }
  }

  // --- Full Generation ---

  async generateMetadata(
    thumbnailBase64: string,
    titleInstruction: string,
    descriptionFormulaTemplate: string,
    descriptionFormulaExample: string | undefined,
    channelInfo: ChannelInfo | null,
    seoKeywords: string,
    tracklist: string,
    iterationIndex: number
  ): Promise<MetadataResult> {
    const imagePart = this.getBaseImagePart(thumbnailBase64);

    const textPart = {
      text: `You are a world-class YouTube SEO expert. Your task is to generate one complete set of metadata for a YouTube video based on its thumbnail, adhering to very strict rules.
      This is variation ${iterationIndex + 1} of 5. Please ensure it's unique from other potential suggestions.
      
      ${this.getChannelInfoInstructions(channelInfo)}
      ${this.getKeywordInstructions(seoKeywords)}

      **Instructions:**
      1.  **Analyze Thumbnail:** Deeply analyze the provided thumbnail image.
      2.  **Generate 1 Title:** Create a unique, click-worthy, SEO-optimized title in English, strictly following this instruction: "${titleInstruction}".

      3.  **Generate 1 SEO-Optimized Description:** Create a description for the title. You MUST use the provided template as a **strict structural framework** to ensure consistency across videos.
          - **Template to use as a framework:**
            ---
            ${descriptionFormulaTemplate}
            ---
          ${this.getDescriptionExampleInstructions(descriptionFormulaExample)}
          - **How to populate and adapt:**
            - **CRITICAL CONTENT RULE:** Your final output for the description must be a complete, natural, and human-readable text ready for YouTube. It MUST NOT contain any of the structural framework markers (e.g., "[PART 1: ...]", "[PART 2: ...]", "(Note: ...)", "[Video Title Goes Here]", etc.). Your job is to replace these markers with real, relevant content based on your analysis, or omit the section if it is not applicable.
            - **CRITICAL FORMATTING RULE:** Your final output for the description MUST preserve the line breaks and paragraph spacing seen in the reference example and implied by the template structure.
            - Replace generic placeholders like \`[VIDEO_HOOK_SENTENCE]\`, \`[DETAILED_VIDEO_SUMMARY]\` with content you generate based on the thumbnail and title.
            - **Channel Handle/Link Replacement (ABSOLUTE RULE):** This is a critical rule for driving subscriptions. The template may contain placeholders like \`@YourChannelHandle\`, \`@channelname\`, or generic calls-to-action like "subscribe to my channel". You MUST replace EVERY SINGLE ONE of these instances with the exact "Channel Subscription Link" provided in the **Channel Information** section (the link is: \`${channelInfo?.channelLink}\`). Do NOT just insert the channel name or handle as plain text. The goal is to insert the full, clickable subscription URL.
            - **Structural Consistency:** While you must generate new content, you must follow the structure of the template to maintain consistency across videos.
            - **SEO is Paramount:** The first 1-3 lines (the hook) are critical. They must be compelling, contain a primary keyword from the title, and accurately reflect the thumbnail's content.
          ${this.getTracklistInstructions(tracklist)}

      4.  **Generate 1 High-Quality Tag Set using the "Tag Pyramid" strategy:** Create a list of 15-20 highly relevant tags, structured in four distinct layers. The final list should be a flat array of strings, with the brand tag appearing last.
          - **Layer 1 (Specific Tags - 1 to 3 tags):** Matches primary keyword phrases.
          - **Layer 2 (Related Tags - 5 to 10 tags):** Synonyms and breakdown of title.
          - ${this.getUserKeywordsForTags(seoKeywords)}
          - You SHOULD also include several relevant tags from the "Channel Core SEO Tags" list provided in the Channel Information section.
          - **Layer 3 (Broad/Category Tags - 3 to 5 tags):** General niche tags.
          - **Foundation Layer (Brand Tag - 1 tag):** The VERY LAST tag in the list MUST be the channel name: "${channelInfo?.channelName || 'My Channel'}".
          - **Final Output Rules:** Combine all tags into a single list of strings. Order: Specific -> Related -> Broad -> Brand.

      5.  **Generate 1 Pinned Comment:** Write an engaging pinned comment that sparks conversation. It MUST:
          - Naturally include a keyword from the title.
          - Include a call-to-action to subscribe using the "Channel Subscription Link" from the channel information provided above.
          - **Do not wrap the output in quotation marks.**

      Return the response as a single, valid JSON object, representing one complete metadata set.`
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              pinnedComment: { type: Type.STRING },
            },
            required: ['title', 'description', 'tags', 'pinnedComment'],
          },
        },
      });

      return JSON.parse(response.text.trim()) as MetadataResult;
    } catch (error) {
      console.error('Error generating metadata:', error);
      throw new Error('Failed to generate metadata from Gemini API.');
    }
  }
}
