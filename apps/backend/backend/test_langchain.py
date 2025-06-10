import asyncio
from langchain_openai import ChatOpenAI
from time import perf_counter
from backend.utils.environment import get_env_variable, EnvironmentVariables

"""Sample Hello World application."""


async def test():
    ts = perf_counter()

    print("Hello")

    llm = ChatOpenAI(
        model="gpt-4o",
        openai_api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
    )

    await asyncio.sleep(1)

    te = perf_counter()

    print(f"Elapsed time - {te-ts} sec.")

if __name__ == "__main__":
    asyncio.run(test())