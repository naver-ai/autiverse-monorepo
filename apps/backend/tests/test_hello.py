"""Hello unit test module."""

from backend.test_langchain import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello backend"
