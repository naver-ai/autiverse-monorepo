import asyncio
from time import perf_counter

"""Sample Hello World application."""


async def test():
    ts = perf_counter()

    print("Hello")

    await asyncio.sleep(1)

    te = perf_counter()

    print(f"Elapsed time - {te-ts} sec.")

if __name__ == "__main__":
    asyncio.run(test())