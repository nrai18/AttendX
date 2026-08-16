from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from google import genai
import os

# Set up the state
class State(TypedDict):
    messages: Annotated[list, add_messages]

def policy_qa_node(state: State):
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "dummy"))
    
    # In a real scenario, retrieve documents from pgvector here (RAG)
    context = "Institute policy states minimum attendance is 75%. Medical leaves require documentation within 3 days."
    
    user_message = state["messages"][-1].content
    prompt = f"Context: {context}\nUser: {user_message}\nAnswer based on context:"
    
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=prompt,
    )
    
    return {"messages": [{"role": "assistant", "content": response.text}]}

# Build graph
graph_builder = StateGraph(State)
graph_builder.add_node("policy_qa", policy_qa_node)
graph_builder.add_edge(START, "policy_qa")
graph_builder.add_edge("policy_qa", END)

chatbot = graph_builder.compile()
