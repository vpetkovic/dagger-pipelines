using TestLib;
using Xunit;

namespace TestLib.Tests;

public class CalculatorTests
{
    [Fact]
    public void Add_ReturnsSum() => Assert.Equal(5, Calculator.Add(2, 3));

    [Fact]
    public void Multiply_ReturnsProduct() => Assert.Equal(6, Calculator.Multiply(2, 3));

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(-1, 1, 0)]
    [InlineData(100, 200, 300)]
    public void Add_VariousInputs(int a, int b, int expected) =>
        Assert.Equal(expected, Calculator.Add(a, b));
}
