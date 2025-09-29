




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts













% this causes the variables to be defined...

















% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "Somewhere, Over The Rainbow" }
			\fill-line {
				"Lyrics by Edgar Yipsel 'Yip' Harburg"
				"Music by Harold Arlen"
			}
			\fill-line {
				"Ballad"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	\repeat volta 2 {
		a2:m7.5- d:7.9- | g2.:m7 a4:7.5- | aes2:maj7 a4:m7.5- d:7.9- | g2:m7 c:7.9- | \myEndLine
		f:m7 aes:m7 | g:m7 c:7.9- | f:m7 bes:7.9- |
	} \alternative {
		{
			ees:maj7 f4:m7 bes:7.9- | \myEndLineVoltaNotLast
		}
		{
			ees2:maj7 f4:m7 bes:7.9- | \myEndLineVoltaLast
		}
	}
	\endPart

	\myMark "B"
	\startPart
	ees1:maj7 | f2:m7 bes:7.9- | g:m7 c:7.9- | f:m7 bes:7.9- | \myEndLine
	ees1:maj7 | a2:m7.5- d:7.9- | g:m7 c:9 | f:m7 bes:7.9- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	a:m7.5- d:7.9- | g2.:m7 a4:7.5- | aes2:maj7 a4:m7.5- d:7.9- | g2:m7 c:7.9- | \myEndLine
	f:m7 aes:m7 | g:m7 c:7.9- | f:m7 bes:7.9- | ees:maj7 f4:m7 bes:7.9- | \myEndLine
	\endPart

	\endSong
	\endChords
}







}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Andante" 4 = 80
	\time 4/4
	\key ees \major

	% part "A"
	\repeat volta 2 {
		ees2 ees' | d4 bes8 c d4 ees | ees,2 c' | bes1 |
		c,2 aes' | g4 ees8 f g4 aes | f d8 ees f4 g |
	} \alternative {
		{
			ees2 r |
		}
		{
			ees2. bes'4 |
		}
	}

	% part "B"
	g8 bes g bes g bes g bes | aes bes aes bes aes bes aes bes | c2 c~ | c r4 bes |
	g8 bes g bes g bes g bes | a c a c a c a c | d2 d | f c |

	% part "A"
	ees,2 ees' | d4 bes8 c d4 ees | ees,2 c' | bes1 |
	c,2 aes' | g4 ees8 f g4 aes | f d8 ees f4 g | ees2 r |
}






 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	Some -- where o -- ver the rain -- bow
	Way up high,
	There's a land that I heard of
	Once in a lu -- lla -- by.

	% part "B"
	_ Some -- day I'll wish u -- pon a star
	And wake up where the clouds are far
	Be -- hind me.
	Where trou -- bles melt like le -- mon drops
	A -- way a -- bove the chim -- ney tops
	That's where you'll find me.

	% part "A"
	Some -- where o -- ver the rain -- bow
	Blue -- birds fly.
	Birds fly o -- ver the rain -- bow.
	Why then, oh why can't I?
}






}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {

	% part "A"
	Some -- where o -- ver the rain -- bow
	Skies are blue,
	And the dreams that you dare to dream
	Real -- ly do come _ true.
}





}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	\repeat volta 2 {
		a2:m7.5- d:7.9- | g2.:m7 a4:7.5- | aes2:maj7 a4:m7.5- d:7.9- | g2:m7 c:7.9- | \myEndLine
		f:m7 aes:m7 | g:m7 c:7.9- | f:m7 bes:7.9- |
	} \alternative {
		{
			ees:maj7 f4:m7 bes:7.9- | \myEndLineVoltaNotLast
		}
		{
			ees2:maj7 f4:m7 bes:7.9- | \myEndLineVoltaLast
		}
	}
	\endPart

	\myMark "B"
	\startPart
	ees1:maj7 | f2:m7 bes:7.9- | g:m7 c:7.9- | f:m7 bes:7.9- | \myEndLine
	ees1:maj7 | a2:m7.5- d:7.9- | g:m7 c:9 | f:m7 bes:7.9- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	a:m7.5- d:7.9- | g2.:m7 a4:7.5- | aes2:maj7 a4:m7.5- d:7.9- | g2:m7 c:7.9- | \myEndLine
	f:m7 aes:m7 | g:m7 c:7.9- | f:m7 bes:7.9- | ees:maj7 f4:m7 bes:7.9- | \myEndLine
	\endPart

	\endSong
	\endChords
}








\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Andante" 4 = 80
	\time 4/4
	\key ees \major

	% part "A"
	\repeat volta 2 {
		ees2 ees' | d4 bes8 c d4 ees | ees,2 c' | bes1 |
		c,2 aes' | g4 ees8 f g4 aes | f d8 ees f4 g |
	} \alternative {
		{
			ees2 r |
		}
		{
			ees2. bes'4 |
		}
	}

	% part "B"
	g8 bes g bes g bes g bes | aes bes aes bes aes bes aes bes | c2 c~ | c r4 bes |
	g8 bes g bes g bes g bes | a c a c a c a c | d2 d | f c |

	% part "A"
	ees,2 ees' | d4 bes8 c d4 ees | ees,2 c' | bes1 |
	c,2 aes' | g4 ees8 f g4 aes | f d8 ees f4 g | ees2 r |
}







}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © Musicopy" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:11 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





