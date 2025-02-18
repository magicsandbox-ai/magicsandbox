from litellm import acompletion

summary_cost = 0.00001

def prompt(user_message: str):
    return [
        {'role': 'system', 'content': 'Create concise 4-5 word summaries of user messages for a chat interface. Focus on the main topic or action. Be brief but descriptive. Do not use punctuation at the end.'},
        {'role': 'user', 'content': 'Can you help me debug this Python code that keeps giving me a TypeError when I try to process a list of dictionaries?'},
        {'role': 'assistant', 'content': 'Python TypeError debugging help'},
        {'role': 'user', 'content': 'What are some good restaurants in Seattle that serve authentic Italian cuisine? I particularly enjoy pasta dishes and would prefer somewhere with a cozy atmosphere.'},
        {'role': 'assistant', 'content': 'Seattle Italian restaurant recommendations'},
        {'role': 'user', 'content': 'I need to create a presentation for tomorrow morning about the latest market trends in renewable energy, focusing specifically on solar and wind power developments.'},
        {'role': 'assistant', 'content': 'renewable energy presentation help'},
        {'role': 'user', 'content': user_message}
    ]

async def handle_summary(args, test=False):
    if not args.summarize:
        return None
    for message in args.messages:
        if message['role'] == 'user':
            user_message = message['content'][:200]
            break
    if user_message is None:
        return None
    api_args = {
        'model': 'gemini/gemini-1.5-flash-8b-001',
        'messages': prompt(user_message),
        'max_completion_tokens': 20,
        'timeout': 60,
    }
    if test:
        api_args.update({
            'mock_response': 'This is a mock summary',
        })
    response = await acompletion(**api_args)
    return response['choices'][0]['message']['content']